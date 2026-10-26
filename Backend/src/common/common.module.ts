import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { EscopoService } from './escopo.service';
import { ParametrosService } from './parametros.service';

@Global()
@Module({
  providers: [AuditoriaService, EscopoService, ParametrosService],
  exports: [AuditoriaService, EscopoService, ParametrosService],
})
export class CommonModule {}
