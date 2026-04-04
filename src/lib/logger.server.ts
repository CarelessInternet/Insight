import { createLogger, format, transports } from 'winston';
import { environment } from './environment';

const { colorize, combine, errors, printf, splat, timestamp } = format;
const logger = createLogger({
	format: combine(
		colorize({ all: true }),
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		splat(),
		errors({ stack: true }),
		printf((info) => `[${info.timestamp}] (${info.level}): ${info.message}`),
	),
	level: environment.LOG_LEVEL,
	transports: [new transports.Console()],
});

export default logger;
