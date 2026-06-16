import db from "../db.server";

export type SettingPatch = Partial<{
  buttonText: string;
  buttonColor: string;
  buttonPosition: string;
  emailFromName: string;
  emailSubject: string;
  threshold: number;
  emailEnabled: boolean;
}>;

/** Setting을 부분 업데이트한다(폼별 partial save). shopId 스코프. */
export async function updateSettings(shopId: string, patch: SettingPatch) {
  return db.setting.update({ where: { shopId }, data: patch });
}
