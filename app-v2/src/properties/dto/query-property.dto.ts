import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';


// @Type(() => Number) is what makes query params work as numbers. URL query strings are always plain text — ?page=1 arrives as the string "1", not the number 1. Without @Type(() => Number), @IsInt would fail on every request because "1" is a string, not an integer. That decorator chain (@IsOptional → @Type(() => Number) → @IsInt) is the exact pattern every pagination param needs

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