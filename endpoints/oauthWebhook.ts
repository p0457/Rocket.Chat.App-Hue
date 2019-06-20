import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { IMessageAttachment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { timeSince } from '../lib/helpers/dates';
import * as msgHelper from '../lib/helpers/messageHelper';
import { createDigestHeader } from '../lib/helpers/request';
import { AppPersistence } from '../lib/persistence';

export class OAuthWebhookEndpooint extends ApiEndpoint {
    public path = 'oauth-callback';

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
      const persistence = new AppPersistence(persis, read.getPersistenceReader());
      let currentAuthAttempts = await persistence.getAuthAttempts();
      if (!currentAuthAttempts) {
        currentAuthAttempts = new Array();
      }
      const userAuthAttempt = currentAuthAttempts.find((authAttempt) => {
        return authAttempt.authId === request.query.state;
      });
      if (!userAuthAttempt) {
        return this.success(); // No message to send, no clue who started process
      }

      const user = await read.getUserReader().getByUsername(userAuthAttempt.userName);
      const room = userAuthAttempt.room;

      if (!request || !request.query || !request.query.code || !request.query.state) {
        await msgHelper.sendNotification('Failed to login!', read, modify, user, room);
        return this.success();
      }

      const clientId = await read.getEnvironmentReader().getSettings().getValueById('hue_clientid');
      const clientSecret = await read.getEnvironmentReader().getSettings().getValueById('hue_clientsecret');
      const appId = await read.getEnvironmentReader().getSettings().getValueById('hue_appid');
      const deviceId = await read.getEnvironmentReader().getSettings().getValueById('hue_deviceid');
      const deviceName = await read.getEnvironmentReader().getSettings().getValueById('hue_devicename');
      const verb = 'POST';
      const uri = '/oauth2/token';

      const code = request.query.code;
      const state = request.query.state;

      const tokenUrl = `https://api.meethue.com/oauth2/token`;
      const params = {
        code,
        grant_type: 'authorization_code',
      };
      let tokenResponse = await http.post(tokenUrl, {params});

      if (!tokenResponse || !tokenResponse.headers || !tokenResponse.headers['www-authenticate']) {
        // Remove the auth attempt from persistence
        currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
          return authAttempt.userName !== user.username;
        });
        await persistence.setAuthAttempts(currentAuthAttempts);
        await msgHelper.sendNotification('Failed to login!', read, modify, user, room);
        return this.success();
      }
      const digestQuery = tokenResponse.headers['www-authenticate'];

      const realmRegex = /realm=\"(.*?)\"/gm;
      const realmRegexResult = realmRegex.exec(digestQuery);
      const realm = realmRegexResult === null ? '' : realmRegexResult[1];

      const nonceRegex = /nonce=\"(.*?)\"/gm;
      const nonceRegexResult = nonceRegex.exec(digestQuery);
      const nonce = nonceRegexResult === null ? '' : nonceRegexResult[1];

      const digestResponse = createDigestHeader(clientId, clientSecret, realm, verb, uri, nonce);

      const headers = {
        Authorization: `Digest username="${clientId}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${digestResponse}"`,
      };

      tokenResponse = await http.post(tokenUrl, {params, headers});

      if (!tokenResponse || tokenResponse.statusCode !== 200 || !tokenResponse.content) {
        // Remove the auth attempt from persistence
        currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
          return authAttempt.userName !== user.username;
        });
        await persistence.setAuthAttempts(currentAuthAttempts);
        await msgHelper.sendNotification('Failed to login!', read, modify, user, room);
        return this.success();
      }

      const content = JSON.parse(tokenResponse.content);
      if (!content.access_token) {
        // Remove the auth attempt from persistence
        currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
          return authAttempt.userName !== user.username;
        });
        await persistence.setAuthAttempts(currentAuthAttempts);
        await msgHelper.sendNotification('Failed to login!', read, modify, user, room);
        return this.success();
      }

      const token = content.access_token;
      const refreshToken = content.refresh_token;

      let text = `*Token: *${token}`;

      if (tokenResponse.headers && tokenResponse.headers.date && content.access_token_expires_in && !isNaN(content.access_token_expires_in)) {
        let expiryDate: Date;
        expiryDate = new Date(tokenResponse.headers.date);
        expiryDate.setSeconds(expiryDate.getSeconds() + Number(content.access_token_expires_in));
        text += `\n*Token expires *${expiryDate} _(${timeSince(expiryDate.toString())})_`;

        if (content.refresh_token_expires_in && !isNaN(content.refresh_token_expires_in)) {
          let refreshExpiryDate: Date;
          refreshExpiryDate = new Date(tokenResponse.headers.date);
          refreshExpiryDate.setSeconds(refreshExpiryDate.getSeconds() + Number(content.refresh_token_expires_in));
          text += `\n*Refresh Token expires *${refreshExpiryDate} _(${timeSince(refreshExpiryDate.toString())})_`;
        }
      }

      await persistence.setUserToken(token, user);
      await persistence.setUserRefreshToken(refreshToken, user);

      // Remove the auth attempt from persistence
      currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
        return authAttempt.userName !== user.username;
      });
      await persistence.setAuthAttempts(currentAuthAttempts);

      let whitelistId = await persistence.getUserBridgeWhitelistId(user);
      if (!whitelistId) {
        const linkButtonResponse = await http.put('https://api.meethue.com/bridge/0/config', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: {
            linkbutton: true,
          },
        });
        if (!linkButtonResponse || linkButtonResponse.statusCode !== 200) {
          await msgHelper.sendNotification('Failed to whitelist this application with your bridge!', read, modify, user, room);
          return this.success();
        }
        const whitelistResponse = await http.post('https://api.meethue.com/bridge', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: {
            devicetype: deviceName,
          },
        });
        if (!whitelistResponse || whitelistResponse.statusCode !== 200 || !whitelistResponse.content) {
          await msgHelper.sendNotification('Failed to whitelist this application with your bridge!', read, modify, user, room);
          return this.success();
        }
        const whitelistResponseContent = JSON.parse(whitelistResponse.content);
        if (!Array.isArray(whitelistResponseContent) || whitelistResponseContent.length === 0) {
          await msgHelper.sendNotification('Failed to whitelist this application with your bridge!', read, modify, user, room);
          return this.success();
        }
        if (!whitelistResponseContent[0] || !whitelistResponseContent[0].success || !whitelistResponseContent[0].success.username) {
          await msgHelper.sendNotification('Failed to whitelist this application with your bridge!', read, modify, user, room);
          return this.success();
        }
        whitelistId = whitelistResponseContent[0].success.username;
        if (!whitelistId) {
          await msgHelper.sendNotification('Failed to whitelist this application with your bridge!', read, modify, user, room);
          return this.success();
        }
        await persistence.setUserBridgeWhitelistId(whitelistId, user);
      }
      text += `\n*Whitelist Id: *${whitelistId}`;

      await msgHelper.sendNotificationMultipleAttachments([
        {
          collapsed: false,
          color: '#00CE00',
          title: {
            value: 'Token saved!',
          },
          text,
        },
      ], read, modify, user, room);

      return this.success();
    }
}
