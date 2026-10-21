import { Module } from '@nestjs/common';
import { RatesModule } from '../rates/rates.module';
import { DepartmentsModule } from '../departments/departments.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [RatesModule, DepartmentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
