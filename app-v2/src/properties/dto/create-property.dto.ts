import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({example: 'The White House'})
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1600 Pennsylvania Ave NW' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Washington' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'DC' })
  @IsString()
  @Length(2,2)
  state: string;
}

