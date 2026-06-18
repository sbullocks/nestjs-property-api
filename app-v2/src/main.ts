import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('hpos_v2_db API Docs')
    .setDescription('The hpos_v2_db API description')
    .setVersion('1.0')
    .addTag('hpos_v2_db')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip fields not in the DTO - ignores extra properties. security feature - if someone sends extra fields not in the DTO, they are silently stripped before reaching the controller.
      transform: true, // auto-convert incoming JSON to the DTO class instance. is required for type coercion, query params always arrive as strings. without this, @Param('id') gives you "1" as string not 1 as number even if you typed it as number.
      forbidNonWhitelisted: true, // don't error on extra fields, just strip them. forbidNonWhitelisted: false → strips all fields → empty {} → stub returns 201 (looks like nothing validated, because nothing did)
      // forbidNonWhitelisted: true → rejects all fields → 400 listing every field as "should not exist"
    }),
  );

  app.enableCors({ origin: 'http://localhost:5173' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
