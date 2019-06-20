import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueScenesCommand implements ISlashCommand {
  public command = 'hue-scenes';
  public i18nParamsExample = 'slashcommand_scenes_params';
  public i18nDescription = 'slashcommand_scenes_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [allArg] = context.getArguments();
    let all = false;
    if (allArg && allArg === 'all') {
      all = true;
    }

    const persistence = new AppPersistence(persis, read.getPersistenceReader());

    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      await msgHelper.sendNotification('No token found! Please login using `/hue-login`', read, modify, context.getSender(), context.getRoom());
      return;
    }
    const whitelistId = await persistence.getUserBridgeWhitelistId(context.getSender());
    if (!whitelistId) {
      await msgHelper.sendNotification('No Whitelist Id found! Please login using `/hue-login`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const url = `https://api.meethue.com/bridge/${whitelistId}/scenes`;

    const groupsResponse = await http.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (groupsResponse.statusCode === 401) {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (!groupsResponse || !groupsResponse.content || groupsResponse.statusCode !== 200) {
      await msgHelper.sendNotification('Failed to parse response!', read, modify, context.getSender(), context.getRoom());
      return;
    }
    const content = JSON.parse(groupsResponse.content);
    if (!content) {
      await msgHelper.sendNotification('Failed to parse response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const scenes = new Array();
    for (const p in content) {
      if (content.hasOwnProperty(p)) {
        if (all === true || content[p].locked === true) {
          const newSceneObj = content[p];
          newSceneObj.id = p;
          scenes.push(newSceneObj);
        }
      }
    }

    await msgHelper.sendScenes(scenes, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
