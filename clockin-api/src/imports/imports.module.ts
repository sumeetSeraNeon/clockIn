import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { UtilisationModule } from '../utilisation/utilisation.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [ClientsModule, ProjectsModule, TasksModule, UtilisationModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
