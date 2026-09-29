import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { FirebaseModule } from './firebase/firebase.module';
import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { ProjectsModule } from './projects/projects.module';
import { RatesModule } from './rates/rates.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { TasksModule } from './tasks/tasks.module';
import { TicketsModule } from './tickets/tickets.module';
import { TimeModule } from './time/time.module';
import { TimesheetsModule } from './timesheets/timesheets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    FirebaseModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    TicketsModule,
    MembersModule,
    TimeModule,
    TimesheetsModule,
    RatesModule,
    ReportsModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
