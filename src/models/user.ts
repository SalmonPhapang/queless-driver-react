/** Port of lib/models/user_model.dart */
export interface UserModel {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export const UserModelX = {
  fromJson(json: Record<string, unknown>): UserModel {
    return {
      id: String(json.id ?? ''),
      email: typeof json.email === 'string' ? json.email : '',
      fullName: typeof json.full_name === 'string' ? json.full_name : 'Unknown Customer',
      phone: typeof json.phone === 'string' ? json.phone : 'No number',
    };
  },

  toJson(user: UserModel): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
    };
  },
};
