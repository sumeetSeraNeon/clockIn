import { Module } from '@nestjs/common';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { TimeEntriesController } from './time-entries.controller';
import { TimeLinesController } from './time-lines.controller';
import { TimeService } from './time.service';

@Module({
  imports: [TimesheetsModule],
  controllers: [TimeEntriesController, TimeLinesController],
  providers: [TimeService],
  exports: [TimeService],
})
export class TimeModule {}
