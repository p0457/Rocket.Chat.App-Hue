import { IPersistence, IPersistenceRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class AppPersistence {
  constructor(private readonly persistence: IPersistence, private readonly persistenceRead: IPersistenceRead) {}

  public async setUserToken(token: string, user: IUser): Promise<void> {
    const userAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id);
    const typeAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-token');

    await this.persistence.updateByAssociations([userAssociation, typeAssociation], { token }, true);
  }

  public async getUserToken(user: IUser): Promise<string | undefined> {
    const userAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id);
    const typeAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-token');

    const [result] = await this.persistenceRead.readByAssociations([userAssociation, typeAssociation]);

    return result ? (result as any).token : undefined;
  }

  public async setUserRefreshToken(token: string, user: IUser): Promise<void> {
    const userAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id);
    const typeAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-refresh-token');

    await this.persistence.updateByAssociations([userAssociation, typeAssociation], { token }, true);
  }

  public async getUserRefreshToken(user: IUser): Promise<string | undefined> {
    const userAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id);
    const typeAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-refresh-token');

    const [result] = await this.persistenceRead.readByAssociations([userAssociation, typeAssociation]);

    return result ? (result as any).token : undefined;
  }

  public async setAuthAttempts(authObj): Promise<void> {
    authObj = JSON.stringify(authObj);
    const miscAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-authattempt');

    await this.persistence.updateByAssociations([miscAssociation], { authObj }, true);
  }

  public async getAuthAttempts(): Promise<any> {
    const miscAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'hue-authattempt');

    const [result] = await this.persistenceRead.readByAssociations([miscAssociation]);

    const actualResult = result ? (result as any).authObj : undefined;
    if (!actualResult) {
      return [];
    } else {
      return JSON.parse(actualResult);
    }
  }
}
