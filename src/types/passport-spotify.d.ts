declare module 'passport-spotify' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    provider: string;
    id: string;
    username: string;
    displayName: string;
    profileUrl: string;
    photos: Array<{ value: string }>;
    emails?: Array<{ value: string; type?: string }>;
    _raw: string;
    _json: any;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    showDialog?: boolean;
  }

  export type VerifyCallback = (
    accessToken: string,
    refreshToken: string,
    expires_in: number,
    profile: Profile,
    done: (error: any, user?: any, info?: any) => void,
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyCallback);
    name: string;
    authenticate(req: any, options?: any): void;
  }
}
