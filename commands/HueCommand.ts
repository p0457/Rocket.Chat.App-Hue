import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachmentField } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import * as msgHelper from '../lib/helpers/messageHelper';
import usage from '../lib/helpers/usage';
import { AppPersistence } from '../lib/persistence';

export class HueCommand implements ISlashCommand {
  public command = 'hue';
  public i18nParamsExample = 'slashcommand_params';
  public i18nDescription = 'slashcommand_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    let text = '';

    for (const p in usage) {
      if (usage.hasOwnProperty(p)) {
        if (usage[p].command && usage[p].usage && usage[p].description) {
          text += usage[p].usage + '\n>' + usage[p].description + '\n';
        }
      }
    }

    text += '\n\n_For choosing hex colors, this website is a great option: http://colorpicker.me_';

    await msgHelper.sendNotificationSingleAttachment({
      collapsed: false,
      color: '#e37200',
      title: {
        value: 'Commands',
      },
      text,
    }, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
