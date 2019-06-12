import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueLightStateCommand implements ISlashCommand {
  public command = 'hue-light-state';
  public i18nParamsExample = 'slashcommand_lightstate_params';
  public i18nDescription = 'slashcommand_lightstate_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const args = context.getArguments();
    if (args.length < 2) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Arguments were invalid!');
      return;
    }

    // Check light ids for numbers
    const lightIds = new Array();
    const lightIdsArg = args[0];
    const lightIdsArgItems = lightIdsArg.split(',');
    if (lightIdsArgItems.length === 0) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Must specify at least one light id!');
      return;
    }
    await lightIdsArgItems.forEach(async (lightIdArg) => {
      const lightArgTemp = Number(lightIdArg.trim());
      if (isNaN(lightArgTemp)) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'One or more light ids were invalid!');
        return;
      } else {
        lightIds.push(lightIdArg.toLowerCase().trim());
      }
    });

    // Check the rest
    const commandUsed = `/hue-light-state ${context.getArguments().join(' ')}`;
    const stateModifiers = context.getArguments().join(' ').replace(`${lightIdsArg} `, '') + ' ';

    const onRegex = /on=(.*?) /gm;
    const onRegexResult = onRegex.exec(stateModifiers);
    const onText = onRegexResult === null ? '' : onRegexResult[1];
    const on = onText.toLowerCase() === 'true' ? true : onText.toLowerCase() === 'false' ? false : undefined;
    if (onText && on === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'on' state value!`);
      return;
    }

    const brightnessRegex = /bri=(.*?) /gm;
    const brightnessRegexResult = brightnessRegex.exec(stateModifiers);
    const brightnessText = brightnessRegexResult === null ? '' : brightnessRegexResult[1];
    const brightness = (!isNaN(Number(brightnessText)) && brightnessText !== '') ? Number(brightnessText) : undefined;
    if (brightnessText && brightness === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'bri' state value!`);
      return;
    }
    if (brightness && (brightness > 254 || brightness < 1)) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'bri' must be between 1 and 254!`);
      return;
    }

    const hueRegex = /hue=(.*?) /gm;
    const hueRegexResult = hueRegex.exec(stateModifiers);
    const hueText = hueRegexResult === null ? '' : hueRegexResult[1];
    const hue = (!isNaN(Number(hueText)) && hueText !== '') ? Number(hueText) : undefined;
    if (hueText && hue === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'hue' state value!`);
      return;
    }
    if (hue && (hue > 65535 || hue < 0)) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'hue' must be between 0 and 65535!`);
      return;
    }

    const saturationRegex = /sat=(.*?) /gm;
    const saturationRegexResult = saturationRegex.exec(stateModifiers);
    const saturationText = saturationRegexResult === null ? '' : saturationRegexResult[1];
    const saturation = (!isNaN(Number(saturationText)) && saturationText !== '') ? Number(saturationText) : undefined;
    if (saturationText && saturation === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'sat' state value!`);
      return;
    }
    if (saturation && (saturation > 254 || saturation < 0)) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'sat' must be between 0 and 254!`);
      return;
    }

    const cieRegex = /cie=(.*?) /gm;
    const cieRegexResult = cieRegex.exec(stateModifiers);
    const cieText = cieRegexResult === null ? '' : cieRegexResult[1];
    const cie = cieText ? cieText.split(':') : undefined;
    if (cie !== undefined && Array.isArray(cie) && cie.length < 2) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' must contain two values!`);
      return;
    }
    if (cie !== undefined && Array.isArray(cie)) {
      await cie.forEach(async (cieCoordinate) => {
        const cieCoordinateNumber = Number(cieCoordinate);
        if (isNaN(cieCoordinateNumber)) {
          await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' coordinates must be numbers!`);
          return;
        } else if (cieCoordinateNumber > 1) {
          await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' coordinates be between 0 and 1!`);
          return;
        }
      });
    }

    const alertRegex = /alert=(.*?) /gm;
    const alertRegexResult = alertRegex.exec(stateModifiers);
    const alertText = alertRegexResult === null ? '' : alertRegexResult[1];
    const alert = alertText.toLowerCase() === 'true' ? true : alertText.toLowerCase() === 'false' ? false : undefined;
    if (alertText && alert === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'alert' state value!`);
      return;
    }

    const payload = {};
    let commandCount = 0;
    if (on !== undefined) {
      commandCount++;
    }
    if (brightness !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['bri'] = brightness;
      commandCount++;
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify brightness state!`);
        return;
      }
    }
    if (hue !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['hue'] = hue;
      commandCount++;
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify brightness state!`);
        return;
      }
    }
    if (saturation !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['sat'] = saturation;
      commandCount++;
    }
    if (cie !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['xy'] = cie;
      commandCount++;
    }
    if (alert !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['alert'] = alert;
      commandCount++;
    }

    if (commandCount === 0) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Must specify at least one state change!');
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

    await lightIds.forEach(async (lightId) => {
      const url = `https://api.meethue.com/bridge/${whitelistId}/lights/${lightId}/state`;

      let lightResponse;
      let content;

      // Must turn on light first for some of these actions
      if (on !== undefined) {
        lightResponse = await http.put(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            on,
          },
        });

        console.log('****lightResponse1', lightResponse);

        if (lightResponse.statusCode === 401) {
          await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (!lightResponse || !lightResponse.content || lightResponse.statusCode !== 200) {
          await msgHelper.sendNotification(`Failed to parse response for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        content = JSON.parse(lightResponse.content);
        if (!content) {
          await msgHelper.sendNotification(`Failed to parse response for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (Array.isArray(content) && content[0].error !== undefined) {
          await msgHelper.sendNotification(`Error occurred for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
      }

      if (commandCount > 1) {
        lightResponse = await http.put(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: payload,
        });

        console.log('****lightResponse2', payload, lightResponse);

        if (lightResponse.statusCode === 401) {
          await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (!lightResponse || !lightResponse.content || lightResponse.statusCode !== 200) {
          await msgHelper.sendNotification(`Failed to parse response for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        content = JSON.parse(lightResponse.content);
        if (!content) {
          await msgHelper.sendNotification(`Failed to parse response for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (Array.isArray(content) && content[0].error !== undefined) {
          console.log(`Error occurred for light id ${lightId}!`, content[0].error);
          await msgHelper.sendNotification(`Error occurred for light id ${lightId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
      }
    });

    await msgHelper.sendNotificationSingleAttachment({
      collapsed: false,
      color: '#0a5ed6',
      title: {
        value: 'Successfully updated lights!',
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
          text: 'Get Lights',
          msg: '/hue-lights ',
          msg_in_chat_window: true,
          msg_processing_type: MessageProcessingType.RespondWithMessage,
        },
      ],
    }, read, modify, context.getSender(), context.getRoom());
    return;
  }
}
