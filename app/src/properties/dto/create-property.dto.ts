import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Apartments' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'TX' })
  @IsString()
  @Length(2, 2) // state abbreviations are exactly 2 characters
  state: string;
}
