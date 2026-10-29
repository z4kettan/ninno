import { Module } from '@nestjs/common';
import { HostelsController } from './hostels.controller';

@Module({ controllers: [HostelsController] })
export class HostelsModule {}
