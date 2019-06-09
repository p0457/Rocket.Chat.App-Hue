import {
  IConfigurationExtend, IEnvironmentRead, ILogger,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { HueCommand } from './commands/HueCommand';
import { OAuthWebhookEndpooint } from './endpoints/oauthWebhook';
import { ApiVisibility, ApiSecurity } from '@rocket.chat/apps-engine/definition/api';

export class HueApp extends App {
    constructor(info: IAppInfo, logger: ILogger) {
        super(info, logger);
    }

    protected async extendConfiguration(configuration: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
      await configuration.settings.provideSetting({
        id: 'hue_name',
        type: SettingType.STRING,
        packageValue: 'Philips Hue',
        required: true,
        public: false,
        i18nLabel: 'customize_name',
        i18nDescription: 'customize_name_description',
      });

      await configuration.settings.provideSetting({
        id: 'hue_icon',
        type: SettingType.STRING,
        packageValue: 'https://raw.githubusercontent.com/tgardner851/Rocket.Chat.App-Hue/master/icon.png',
        required: true,
        public: false,
        i18nLabel: 'customize_icon',
        i18nDescription: 'customize_icon_description',
      });

      await configuration.api.provideApi({
        visibility: ApiVisibility.PUBLIC,
        security: ApiSecurity.UNSECURE,
        endpoints: [new OAuthWebhookEndpooint(this)],
      });

      await configuration.settings.provideSetting({
        id: 'hue_clientid',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'customize_clientid',
        i18nDescription: 'customize_clientid_description',
      });

      await configuration.settings.provideSetting({
        id: 'hue_clientsecret',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'customize_clientsecret',
        i18nDescription: 'customize_clientsecret_description',
      });

      await configuration.slashCommands.provideSlashCommand(new HueCommand(this));
    }
}
