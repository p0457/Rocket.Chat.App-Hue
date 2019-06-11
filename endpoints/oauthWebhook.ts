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

      let text = '';

      let expiryDate: Date;
      if (tokenResponse.headers && tokenResponse.headers.date && content.access_token_expires_in && !isNaN(content.access_token_expires_in)) {
        expiryDate = new Date(tokenResponse.headers.date);
        expiryDate.setSeconds(expiryDate.getSeconds() + Number(content.access_token_expires_in));
        text += `*Token expires *${expiryDate} _(${timeSince(expiryDate.toString())})_`;
      }

      await persistence.setUserToken(token, user);
      await persistence.setUserRefreshToken(refreshToken, user);

      // Remove the auth attempt from persistence
      currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
        return authAttempt.userName !== user.username;
      });
      await persistence.setAuthAttempts(currentAuthAttempts);

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
