import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage, IMessageAction, IMessageAttachment, MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { formatDate, getYear, timeSince } from './dates';
import usage from './usage';

export async function sendNotification(text: string, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('hue_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('hue_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      text,
      groupable: false,
      alias: username,
      avatarUrl: icon,
  }).getMessage());
}

export async function sendNotificationSingleAttachment(attachment: IMessageAttachment, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('hue_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('hue_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      groupable: false,
      alias: username,
      avatarUrl: icon,
      attachments: [attachment],
  }).getMessage());
}

export async function sendNotificationMultipleAttachments(attachments: Array<IMessageAttachment>, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('hue_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('hue_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      groupable: false,
      alias: username,
      avatarUrl: icon,
      attachments,
  }).getMessage());
}

export async function sendUsage(read: IRead, modify: IModify, user: IUser, room: IRoom, scope: string, additionalText?): Promise<void> {
  let text = '';

  let usageObj = usage[scope];
  if (!usageObj) {
    for (const p in usage) {
      if (usage.hasOwnProperty(p)) {
        if (usage[p].command === scope) {
          usageObj = usage[p];
        }
      }
    }
  }
  if (usageObj && usageObj.command && usageObj.usage && usageObj.description) {
    text = '*Usage: *' + usageObj.usage + '\n>' + usageObj.description;
  }

  if (additionalText) {
    text = additionalText + '\n' + text;
  }

  // tslint:disable-next-line:max-line-length
  await this.sendNotification(text, read, modify, user, room);
  return;
}

export async function sendTokenExpired(read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  await sendNotificationSingleAttachment({
    collapsed: false,
    color: '#e10000',
    title: {
      value: 'Token Expired!',
    },
    text: 'Please login again using `/hue-login`',
  }, read, modify, user, room);
}

export async function sendLights(lights, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const attachments = new Array<IMessageAttachment>();
  // Initial attachment for results count
  const resultAttachmentActions = new Array<IMessageAction>();
  const countOfOn = lights.filter((light) => {
    return light.state.on === true;
  }).length;
  const countOfOff = lights.length - countOfOn;
  const lightIds = new Array();
  lights.forEach((light) => {
    lightIds.push(light.id.trim());
  });
  if (countOfOff > 0) {
    resultAttachmentActions.push({
      type: MessageActionType.BUTTON,
      text: 'Turn All On',
      msg: `/hue-light-state ${lightIds.join(',')} on=true`,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  }
  if (countOfOn > 0) {
    resultAttachmentActions.push({
      type: MessageActionType.BUTTON,
      text: 'Turn All Off',
      msg: `/hue-light-state ${lightIds.join(',')} on=false`,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  }
  attachments.push({
    collapsed: false,
    color: '#00CE00',
    title: {
      value: `Results (${lights.length})`,
    },
    actions: resultAttachmentActions,
    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
  });

  lights.forEach((light) => {
    let text = '';

    text += `*Brightness: *${light.state.bri}\n`;
    text += `*Hue: *${light.state.hue}\n`;
    text += `*Saturation: *${light.state.sat}\n`;
    text += `*CIE: *${light.state.xy.join(',')}\n`;
    text += `*Color Temperature: *${light.state.ct}\n`;
    text += `*Color Mode: *${light.state.colormode}\n`;
    text += `*Effect: *${light.state.effect}\n`;
    text += `*Alerting: *${light.state.alert}`;

    const fields = new Array();

    fields.push({
      short: true,
      title: 'Type',
      value: `${light.manufacturername} ${light.modelid} (${light.type})`,
    });
    fields.push({
      short: true,
      title: 'Software',
      value: `v${light.swversion}`,
    });

    const actions = new Array<IMessageAction>();

    const stateChangeCommand = `/hue-light-state ${light.id} on=${light.state.on} bri=${light.state.bri} ` +
      `hue=${light.state.hue} sat=${light.state.sat} alert=${light.state.alert === 'none' ? false : true} ` +
      `cie=${light.state.xy.join(':')} `;

    actions.push({
      type: MessageActionType.BUTTON,
      text: 'Change State',
      msg: stateChangeCommand,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });

    if (light.state.alert === 'none') {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Alert Light',
        msg: `/hue-light-state ${light.id} alert=true `,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    } else {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Turn Off Alert',
        msg: `/hue-light-state ${light.id} alert=false `,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }

    if (light.state.on === true) {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Turn Off Light',
        msg: `/hue-light-state ${light.id} on=false `,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    } else {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Turn On Light',
        msg: `/hue-light-state ${light.id} on=true `,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }

    attachments.push({
      collapsed: lights.length > 5 ? true : false,
      color: '#0a5ed6',
      title: {
        value: `${light.name} (${light.state.on === true ? 'On' : 'Off'})`,
      },
      actions,
      actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
      fields,
      text,
    });
  });

  await sendNotificationMultipleAttachments(attachments, read, modify, user, room);
}
