import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './auth.decorators';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseEntity, AuthUserEntity } from './entities/auth.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TooManyLoginAttemptsException } from './login-rate-limiter';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastra um usuário. O primeiro cadastrado vira ADMIN.' })
  @ApiCreatedResponse({ type: AuthResponseEntity })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado.' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseEntity> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com e-mail e senha e devolve os tokens.' })
  @ApiOkResponse({ type: AuthResponseEntity })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos.' })
  @ApiTooManyRequestsResponse({
    description:
      'Tentativas demais para este e-mail a partir deste IP; veja o cabeçalho Retry-After.',
  })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseEntity> {
    try {
      return await this.auth.login(dto, ip);
    } catch (error) {
      if (error instanceof TooManyLoginAttemptsException) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Troca um token de renovação por um novo par; o token usado deixa de valer.',
  })
  @ApiOkResponse({ type: AuthResponseEntity })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  @ApiUnauthorizedResponse({ description: 'Token de renovação inválido ou expirado.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseEntity> {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Encerra a sessão: revoga o token de renovação e os que vieram dele por rotação.',
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada (repetir não tem efeito).' })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  @ApiUnauthorizedResponse({ description: 'Token de renovação inválido ou expirado.' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devolve o usuário do token de acesso.' })
  @ApiOkResponse({ type: AuthUserEntity })
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
