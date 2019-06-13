import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { HueApp } from '../HueApp';
import { hexToRgb, rgb_to_cie } from '../lib/helpers/colorManager';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class HueGroupStateCommand implements ISlashCommand {
  public command = 'hue-group-state';
  public i18nParamsExample = 'slashcommand_groupstate_params';
  public i18nDescription = 'slashcommand_groupstate_description';
  public providesPreview = false;

  public constructor(private readonly app: HueApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const args = context.getArguments();
    if (args.length < 2) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Arguments were invalid!');
      return;
    }

    // Check group ids for numbers
    const groupIds = new Array();
    const groupIdsArg = args[0];
    const groupIdsArgItems = groupIdsArg.split(',');
    if (groupIdsArgItems.length === 0) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Must specify at least one group id!');
      return;
    }
    await groupIdsArgItems.forEach(async (groupIdArg) => {
      const groupArgTemp = Number(groupIdArg.trim());
      if (isNaN(groupArgTemp)) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'One or more group ids were invalid!');
        return;
      } else {
        groupIds.push(groupIdArg.toLowerCase().trim());
      }
    });

    // Check the rest
    const commandUsed = `/hue-group-state ${context.getArguments().join(' ')}`;
    const stateModifiers = context.getArguments().join(' ').replace(`${groupIdsArg} `, '') + ' ';

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

    const colorTempRegex = /ct=(.*?) /gm;
    const colorTempRegexResult = colorTempRegex.exec(stateModifiers);
    const colorTempText = colorTempRegexResult === null ? '' : colorTempRegexResult[1];
    const colorTemp = (!isNaN(Number(colorTempText)) && colorTempText !== '') ? Number(colorTempText) : undefined;
    if (colorTempText && colorTemp === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'ct' state value!`);
      return;
    }
    if (colorTemp && (colorTemp > 500 || colorTemp < 153)) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'ct' must be between 153 and 500!`);
      return;
    }

    const cieRegex = /cie=(.*?) /gm;
    const cieRegexResult = cieRegex.exec(stateModifiers);
    const cieText = cieRegexResult === null ? '' : cieRegexResult[1];
    const cieTemp = cieText ? cieText.split(':') : undefined;
    const cie = new Array<number>();
    if (cieTemp !== undefined && Array.isArray(cieTemp) && cieTemp.length < 2) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' must contain two values!`);
      return;
    }
    if (cieTemp !== undefined && Array.isArray(cieTemp)) {
      await cieTemp.forEach(async (cieCoordinate) => {
        const cieCoordinateNumber = Number(cieCoordinate);
        if (isNaN(cieCoordinateNumber)) {
          await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' coordinates must be numbers!`);
          return;
        } else if (cieCoordinateNumber > 1) {
          await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'cie' coordinates be between 0 and 1!`);
          return;
        } else {
          cie.push(cieCoordinateNumber);
        }
      });
    }

    const alertRegex = /alert=(.*?) /gm;
    const alertRegexResult = alertRegex.exec(stateModifiers);
    const alertText = alertRegexResult === null ? '' : alertRegexResult[1];
    const alert = alertText.toLowerCase() === 'true' ? 'lselect' : alertText.toLowerCase() === 'false' ? 'none' : undefined;
    if (alertText && alert === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'alert' state value!`);
      return;
    }

    const colorRegex = /color=(.*?) /gm;
    const colorRegexResult = colorRegex.exec(stateModifiers);
    const colorText = colorRegexResult === null ? '' : colorRegexResult[1];
    const color = colorText === '' ? undefined : colorText;
    if (colorText && color === undefined) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Failed to parse 'color' state value!`);
      return;
    }
    if (color !== undefined && (!color.startsWith('#') || color.length !== 7)) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `'color' must be a hex value starting with #!`);
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
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify hue state!`);
        return;
      }
      if (color) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Cannot specify color with other color properties!`);
        return;
      }
    }
    if (saturation !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['sat'] = saturation;
      commandCount++;
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify saturation state!`);
        return;
      }
      if (color) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Cannot specify color with other color properties!`);
        return;
      }
    }
    if (saturation !== undefined) {
      // tslint:disable-next-line:no-string-literal
      payload['ct'] = colorTemp;
      commandCount++;
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify color temp state!`);
        return;
      }
      if (color) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Cannot specify color with other color properties!`);
        return;
      }
    }
    if (cie !== undefined && cie.length === 2) {
      // tslint:disable-next-line:no-string-literal
      payload['xy'] = cie;
      commandCount++;
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify CIE color state!`);
        return;
      }
      if (color) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Cannot specify color with other color properties!`);
        return;
      }
    }
    if (color !== undefined) {
      commandCount++;
      const rgb = hexToRgb(color);
      if (rgb && Array.isArray(rgb) && rgb.length === 3) {
        const cieCoordinates = rgb_to_cie(rgb[0], rgb[1], rgb[2]);
        // tslint:disable-next-line:no-string-literal
        payload['xy'] = cieCoordinates;
      }
      if (on !== true) {
        await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, `Must specify 'on=true' to modify CIE color state!`);
        return;
      }
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

    groupIds.forEach(async (groupId) => {
      const url = `https://api.meethue.com/bridge/${whitelistId}/groups/${groupId}/action`;

      let groupResponse;
      let content;

      // Must turn on light first for some of these actions
      if (on !== undefined) {
        groupResponse = await http.put(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            on,
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
        content = JSON.parse(groupResponse.content);
        if (!content) {
          await msgHelper.sendNotification(`Failed to parse response for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (Array.isArray(content) && content[0].error !== undefined) {
          console.log(`Error occurred for group id ${groupId}!`, content[0].error);
          await msgHelper.sendNotification(`Error occurred for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
      }

      if (commandCount > 1) {
        groupResponse = await http.put(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: payload,
        });

        if (groupResponse.statusCode === 401) {
          await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (!groupResponse || !groupResponse.content || groupResponse.statusCode !== 200) {
          await msgHelper.sendNotification(`Failed to parse response for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        content = JSON.parse(groupResponse.content);
        if (!content) {
          await msgHelper.sendNotification(`Failed to parse response for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
        if (Array.isArray(content) && content[0].error !== undefined) {
          console.log(`Error occurred for group id ${groupId}!`, content[0].error);
          await msgHelper.sendNotification(`Error occurred for group id ${groupId}!`, read, modify, context.getSender(), context.getRoom());
          return;
        }
      }
    });

    await msgHelper.sendNotificationSingleAttachment({
      collapsed: false,
      color: '#0a5ed6',
      title: {
        value: 'Successfully updated groups!',
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
