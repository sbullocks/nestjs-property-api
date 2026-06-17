import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
  import { PropertiesService } from './properties.service';
  import { CreatePropertyDto } from './dto/create-property.dto';
  import { UpdatePropertyDto } from './dto/update-property.dto';
  import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
  import { RolesGuard } from 'src/common/guards/roles.guard';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { Role } from 'src/common/enums/role.enum';
  import { CurrentUser } from 'src/common/decorators/current-user.decorator';
  import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
  import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { QueryPropertyDto } from './dto/query-property.dto';

// @UseGuards(ApiKeyGuard)
@ApiTags('properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}


  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({ status: 201, description: 'Property created' })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto, user.tenantId);
  }
  @ApiOperation({ summary: 'Get all properties for the current tenant' })
  @ApiResponse({ status: 200, description: 'Returns array of properties' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'city', required: false, example: 'Austin' })
  @ApiQuery({ name: 'state', required: false, example: 'TX' })
  @ApiQuery({ name: 'search', required: false, example: 'Sunset' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryPropertyDto) {
    return this.propertiesService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload,) {
    return this.propertiesService.findOne(+id, user.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto, @CurrentUser() user: JwtPayload,) {
    return this.propertiesService.update(+id, updatePropertyDto, user.tenantId);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload,) {
    return this.propertiesService.remove(+id, user.tenantId);
  }
}
