import { Module } from '@nestjs/common';
import { UtilisationController } from './utilisation.controller';
import { UtilisationService } from './utilisation.service';

@Module({
  controllers: [UtilisationController],
  providers: [UtilisationService],
  exports: [UtilisationService],
})
export class UtilisationModule {}
