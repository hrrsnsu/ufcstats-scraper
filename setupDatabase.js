import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function setup() {
    try {
        console.log('Connection established');

        //Create ufc_events table
        await sql`DROP TABLE IF EXISTS ufc_events`;
        await sql`
        	CREATE TABLE ufc_events (
        		id SERIAL PRIMARY KEY,
        		event_name VARCHAR(255) NOT NULL,
        		event_date DATE,
        		event_location VARCHAR(255)
        	);
        `;

        //Create fighters table
        await sql`DROP TABLE IF EXISTS fighters`;

        await sql`
			CREATE TABLE fighters (
				id SERIAL PRIMARY KEY,
				first_name VARCHAR(255) NOT NULL,
				last_name VARCHAR(255),
				height VARCHAR(255),
				weight INT,
				reach INT,
				stance VARCHAR(255),
				slpm DECIMAL,
				strAcc DECIMAL,
				sapm DECIMAL,
				strDef DECIMAL,
				tdAvg DECIMAL,
				tdAcc DECIMAL,
				tdDef DECIMAL,
				subAvg DECIMAL
			);
		`;

        console.log('Finished creating tables.');
    } catch (err) {
        console.error('Connection failed.', err);
    }
}

setup();
