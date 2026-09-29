import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private ready = false;
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const existing = getApps();
    if (existing.length > 0) {
      this.app = existing[0]!;
      this.ready = true;
      this.logger.log('Firebase Admin already initialised (reusing existing app)');
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const envPath = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    const relativeFallback = join(
      process.cwd(),
      'secrets',
      'firebase-service-account.json',
    );

    const tried: string[] = [];

    if (envPath) {
      tried.push(envPath);
      if (this.tryInitFromFile(envPath, projectId)) {
        return;
      }
      this.logger.warn(
        `Failed to load Firebase credentials from GOOGLE_APPLICATION_CREDENTIALS (${envPath}). Falling back to ./secrets/firebase-service-account.json`,
      );
    }

    tried.push(relativeFallback);
    if (this.tryInitFromFile(relativeFallback, projectId)) {
      return;
    }

    this.logger.error(
      `Firebase Admin failed to initialise. Tried: ${tried.join(' | ')}`,
    );
    throw new ServiceUnavailableException(
      'Firebase Admin is not configured. Check GOOGLE_APPLICATION_CREDENTIALS or secrets/firebase-service-account.json',
    );
  }

  get auth(): Auth {
    this.assertReady();
    return getAuth(this.app!);
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken);
  }

  /**
   * Ensure a Firebase Auth user exists for this email.
   * Creates one when missing; returns a password-reset link so the person
 * can set a password. Phase2 FIX6 may also email the link via SMTP when configured.
 */
  async ensureAuthUser(
    email: string,
    displayName?: string,
  ): Promise<{ uid: string; passwordResetLink: string | null }> {
    this.assertReady();
    const normalised = email.trim().toLowerCase();

    let uid: string;
    try {
      const existing = await this.auth.getUserByEmail(normalised);
      uid = existing.uid;
      if (displayName && existing.displayName !== displayName) {
        await this.auth.updateUser(uid, { displayName }).catch(() => undefined);
      }
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      if (code !== 'auth/user-not-found') {
        throw error;
      }
      const created = await this.auth.createUser({
        email: normalised,
        displayName: displayName?.trim() || undefined,
        emailVerified: false,
        disabled: false,
      });
      uid = created.uid;
    }

    let passwordResetLink: string | null = null;
    try {
      passwordResetLink = await this.auth.generatePasswordResetLink(normalised);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not generate password reset link for ${normalised}: ${message}`,
      );
    }

    return { uid, passwordResetLink };
  }

  private tryInitFromFile(
    credentialPath: string,
    projectId?: string,
  ): boolean {
    try {
      const absolutePath = isAbsolute(credentialPath)
        ? credentialPath
        : resolve(process.cwd(), credentialPath);

      if (!existsSync(absolutePath)) {
        this.logger.warn(`Firebase credential file not found: ${absolutePath}`);
        return false;
      }

      const raw = readFileSync(absolutePath, 'utf8');
      const serviceAccount = JSON.parse(raw) as ServiceAccountJson;

      if (
        !serviceAccount.client_email ||
        !serviceAccount.private_key ||
        !serviceAccount.project_id
      ) {
        this.logger.warn(
          `Firebase credential file is missing required fields: ${absolutePath}`,
        );
        return false;
      }

      const resolvedProjectId = serviceAccount.project_id;
      if (projectId && projectId !== resolvedProjectId) {
        this.logger.warn(
          `FIREBASE_PROJECT_ID=${projectId} differs from service account project_id=${resolvedProjectId}; using service account project_id`,
        );
      }

      this.app = initializeApp({
        credential: cert({
          projectId: resolvedProjectId,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId: resolvedProjectId,
      });

      this.ready = true;
      this.logger.log(
        `Firebase Admin initialised successfully from ${absolutePath} (project: ${resolvedProjectId})`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not initialise Firebase from "${credentialPath}": ${message}`,
      );
      return false;
    }
  }

  private assertReady(): void {
    if (!this.ready || !this.app) {
      throw new ServiceUnavailableException('Firebase Admin is not ready');
    }
  }
}
