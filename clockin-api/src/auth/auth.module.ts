import { Global, Module } from '@nestjs/common';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { MeController } from './me.controller';
import { PermissionsGuard } from './permissions.guard';
import { VisibilityService } from './visibility.service';

@Global()
@Module({
  controllers: [MeController, AccessRequestController],
  providers: [
    FirebaseAuthGuard,
    PermissionsGuard,
    AccessRequestService,
    VisibilityService,
  ],
  exports: [FirebaseAuthGuard, PermissionsGuard, VisibilityService],
})
export class AuthModule {}
