import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueLoginCommand implements ISlashCommand {
  public command = 'hue-login';
  public i18nParamsExample = 'slashcommand_login_params';
  public i18nDescription = 'slashcommand_login_description';
  public providesPreview = false;

  public endpoint = '';

  public constructor(private readonly app: HueApp) {
    try {
      const accessors = app.getAccessors();
      const endpoints = accessors.providedApiEndpoints;
      if (endpoints) {
        const endpoint = endpoints.find((appEndpoint) => {
          return appEndpoint.path === 'oauth-callback';
        });
        if (endpoint) {
          this.endpoint = endpoint.computedPath;
        }
      }
    } catch (e) {
      console.log('Failed to find oauth-callback endpoint entry!', e);
    }
  }

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const clientId = await read.getEnvironmentReader().getSettings().getValueById('hue_clientid');
    const clientSecret = await read.getEnvironmentReader().getSettings().getValueById('hue_clientsecret');
    const appId = await read.getEnvironmentReader().getSettings().getValueById('hue_appid');
    const deviceId = await read.getEnvironmentReader().getSettings().getValueById('hue_deviceid');
    const deviceName = await read.getEnvironmentReader().getSettings().getValueById('hue_devicename');
    let rootUrl = await read.getEnvironmentReader().getEnvironmentVariables().getValueByName('ROOT_URL');
    if (rootUrl.endsWith('/')) {
      rootUrl = rootUrl.substring(0, rootUrl.length - 1); // remove last '/'
    }

    const newUuid = uuidv4();

    // tslint:disable-next-line:max-line-length
    const url = `https://api.meethue.com/oauth2/auth?clientid=${clientId}&appid=${appId}&deviceid=${deviceId}&devicename=${deviceName}&state=${newUuid}&response_type=code`;

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    let currentAuthAttempts = await persistence.getAuthAttempts();
    if (!currentAuthAttempts) {
      currentAuthAttempts = new Array();
    }
    const userAuthAttemptIdx = currentAuthAttempts.findIndex((authAttempt) => {
      return authAttempt.userName === context.getSender().username;
    });
    if (userAuthAttemptIdx && userAuthAttemptIdx >= 0) {
      currentAuthAttempts[userAuthAttemptIdx] = {
        userName: context.getSender().username,
        room: context.getRoom(),
        authId: newUuid,
      };
    } else {
      currentAuthAttempts.push({
        userName: context.getSender().username,
        room: context.getRoom(),
        authId: newUuid,
      });
    }
    await persistence.setAuthAttempts(currentAuthAttempts);

    const attachment = {
      collapsed: false,
      actions: [
        {
          type: MessageActionType.BUTTON,
          url,
          text: 'Login',
          msg_in_chat_window: false,
          msg_processing_type: MessageProcessingType.SendMessage,
        },
      ],
      text: 'You will now need to open a browser to initiate an OAuth authorization. Once completed,' +
        'the application will automatically obtain the appropriate token and response back when completed.',
    };
    await msgHelper.sendNotificationMultipleAttachments([attachment], read, modify, context.getSender(), context.getRoom());
  }
}
