// Query parmas arrive in the URL and NestJS extracts them with @Query(). Define the DTO to type and validate them below.
// example query parmas: ?page=1&limit=10&city=Austin

import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPropertyDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number) // query params arrive as strings — this coerces to number
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Sunset' })
  @IsOptional()
  @IsString()
  search?: string;
}
