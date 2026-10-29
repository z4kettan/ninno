import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ResidentFilesService } from './resident-files.service';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';

@Module({
  imports: [StorageModule],
  controllers: [ResidentsController],
  providers: [ResidentsService, ResidentFilesService],
})
export class ResidentsModule {}
