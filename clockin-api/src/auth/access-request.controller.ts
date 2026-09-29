import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessRequestService } from './access-request.service';
import { RequestAccessDto } from './dto/request-access.dto';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * Public (token-verified) endpoint: user creates a Firebase account on the
 * client, then posts here so an admin can approve org access.
 */
@Controller('auth')
export class AccessRequestController {
  constructor(
    private readonly accessRequests: AccessRequestService,
    private readonly firebase: FirebaseService,
  ) {}

  @Post('request-access')
  @HttpCode(HttpStatus.CREATED)
  async requestAccess(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RequestAccessDto,
  ) {
    const token = this.extractBearerToken(authorization);
    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
    return this.accessRequests.requestAccess(decoded, dto);
  }

  private extractBearerToken(header: string | undefined): string {
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException(
        'Missing Authorization header (expected Bearer <Firebase ID token>)',
      );
    }
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Malformed Authorization header (expected Bearer <Firebase ID token>)',
      );
    }
    return token;
  }
}
