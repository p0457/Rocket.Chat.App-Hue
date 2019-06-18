import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueSceneCommand implements ISlashCommand {
  public command = 'hue-scene';
  public i18nParamsExample = 'slashcommand_scene_params';
  public i18nDescription = 'slashcommand_scene_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [sceneId, groupIdArg] = context.getArguments();

    const commandUsed = `/${this.command} ${context.getArguments().join(' ')}`;

    if (!sceneId) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Must provide a scene id!');
      return;
    }

    let groupId = 0;
    if (groupIdArg) {
      const groupIdArgTemp = Number(groupIdArg);
      if (isNaN(groupIdArgTemp)) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Group id must be a number!');
        return;
      }
      groupId = groupIdArgTemp;
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

    const url = `https://api.meethue.com/bridge/${whitelistId}/groups/${groupId}/action`;

    const groupResponse = await http.put(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        scene: sceneId,
      },
    });

    if (groupResponse.statusCode === 401) {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (!groupResponse || !groupResponse.content || groupResponse.statusCode !== 200) {
      await msgHelper.sendNotification(`Failed to parse response for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
      return;
    }
    const content = JSON.parse(groupResponse.content);
    if (!content) {
      await msgHelper.sendNotification(`Failed to parse response for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (Array.isArray(content) && content[0].error !== undefined) {
      console.log(`Error setting scene!`, content[0].error);
      await msgHelper.sendNotification(`Error setting scene!`, read, modify, context.getSender(), context.getRoom());
      return;
    }

    await msgHelper.sendNotificationSingleAttachment({
      collapsed: false,
      color: '#0a5ed6',
      title: {
        value: 'Successfully recalled scene!',
      },
      actions: [
        {
          type: MessageActionType.BUTTON,
          text: 'Run Again',
          msg: commandUsed,
          msg_in_chat_window: true,
          msg_processing_type: MessageProcessingType.RespondWithMessage,
        },
        {
          type: MessageActionType.BUTTON,
          text: 'Get Groups',
          msg: '/hue-groups ',
          msg_in_chat_window: true,
          msg_processing_type: MessageProcessingType.RespondWithMessage,
        },
      ],
      actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
    }, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
