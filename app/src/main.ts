import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip fields not in the DTO - ignores extra properties. security feature - if someone sends extra fields not in the DTO, they are silently stripped before reaching the controller.
      transform: true, // auto-convert incoming JSON to the DTO class instance. is required for type coercion, query params always arrive as strings. without this, @Param('id') gives you "1" as string not 1 as number even if you typed it as number.
      forbidNonWhitelisted: false, // don't error on extra fields, just strip them
    }),
  );

  // Handling CORS so Frontend can access rotues! This instruction was provided in the Frontend upskilling. Phase 2 had me test the frontend login page and ran into a CORS error.
  app.enableCors({ origin: 'http://localhost:5173' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// Add @ApiProperty() to all fields in CreatePropertyDto and UpdatePropertyDto.

// Add @ApiTags('properties') and @ApiBearerAuth() to PropertiesController.
