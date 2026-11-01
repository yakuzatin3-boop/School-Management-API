import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'school_management',
  entities: ['src/**/*.entity.ts'],
  synchronize: true,
  logging: ['schema', 'error'],
});

AppDataSource.initialize()
  .then(async () => {
    console.log('Tables created successfully from all entities.');
    await AppDataSource.destroy();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error creating tables:', err);
    process.exit(1);
  });
