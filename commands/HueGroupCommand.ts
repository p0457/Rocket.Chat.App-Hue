import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueGroupCommand implements ISlashCommand {
  public command = 'hue-group';
  public i18nParamsExample = 'slashcommand_group_params';
  public i18nDescription = 'slashcommand_group_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const groupIdOrName = context.getArguments().join(' ');

    if (!groupIdOrName) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Group Id or Name must be provided!');
      return;
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

    const url = `https://api.meethue.com/bridge/${whitelistId}/groups`;

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

    const groups = new Array();
    for (const p in content) {
      if (content.hasOwnProperty(p)) {
        if (p === groupIdOrName || content[p].name.toLowerCase().indexOf(groupIdOrName.toLowerCase().trim()) !== -1) {
          const newGroupObj = content[p];
          newGroupObj.id = p;
          groups.push(newGroupObj);
        }
      }
    }

    await msgHelper.sendGroups(groups, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
