import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueLightsCommand implements ISlashCommand {
  public command = 'hue-lights';
  public i18nParamsExample = 'slashcommand_lights_params';
  public i18nDescription = 'slashcommand_lights_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
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

    const url = `https://api.meethue.com/bridge/${whitelistId}/lights`;

    const lightsResponse = await http.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (lightsResponse.statusCode === 401) {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (!lightsResponse || !lightsResponse.content || lightsResponse.statusCode !== 200) {
      await msgHelper.sendNotification('Failed to parse response!', read, modify, context.getSender(), context.getRoom());
      return;
    }
    const content = JSON.parse(lightsResponse.content);
    if (!content) {
      await msgHelper.sendNotification('Failed to parse response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const lights = new Array();
    for (const p in content) {
      if (content.hasOwnProperty(p)) {
        const newLightObj = content[p];
        newLightObj.id = p;
        lights.push(newLightObj);
      }
    }

    await msgHelper.sendLights(lights, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
