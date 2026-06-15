import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
// import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { Role } from 'src/common/enums/role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('properties') // groups routes under "properties" in the UI
@ApiBearerAuth() // shows the padlock icon — route requires JWT
@Controller('properties')
// @UseGuards(ApiKeyGuard) // in Phase 2, will replace with JwtAuthGuard + RolesGuard
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // @Post()
  // create(@Body() createPropertyDto: CreatePropertyDto) {
  //   return this.propertiesService.create(createPropertyDto);
  // } // in Phase 3, must update the id to be passed from the user, not the DTO. REQUIRED!
  // return this.propertiesService.create(body, body.tenantId); // tenantId from body = dangerous

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createPropertyDto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(createPropertyDto, user.tenantId);
  } // // tenantId from JWT = safe

  @ApiOperation({ summary: 'Get all properties for the current tenant' })
  @ApiResponse({ status: 200, description: 'Returns array of properties' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.propertiesService.findAll(user.tenantId);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.propertiesService.findOne(+id);
  // } // in Phase 3, need to update the contorller to pass user.tenantId

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.findOne(+id, user.tenantId);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updatePropertyDto: UpdatePropertyDto,
  // ) {
  //   return this.propertiesService.update(+id, updatePropertyDto);
  // } // in Phase 3, updating the route to use the tenantId of the user (JWT), not the DTO.

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(+id, updatePropertyDto, user.tenantId);
  }

  // @Roles(Role.Admin) // only admins can delete
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.propertiesService.remove(+id);
  // } in Phase 3, updating to use the jwt user.id and not the DTO. REQUIRED.

  @Roles(Role.Admin) // only admins can delete
  @Delete(`:id`)
  remove(@Param(`id`) id: string, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.remove(+id, user.tenantId);
  }
}
