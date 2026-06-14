import { Module } from '@nestjs/common';
import { SshProvisionerService } from './ssh-provisioner.service';

@Module({
  providers: [SshProvisionerService],
  exports: [SshProvisionerService],
})
export class ProvisioningModule {}
