import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());

  // add the swagger setup..
  const config = new DocumentBuilder()
    .setTitle('HPOS API')
    .setDescription('Property management API')
    .setVersion('1.0')
    .addBearerAuth() // adds JWT auth to the UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// Add @ApiProperty() to all fields in CreatePropertyDto and UpdatePropertyDto.

// Add @ApiTags('properties') and @ApiBearerAuth() to PropertiesController.
