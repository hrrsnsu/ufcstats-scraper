import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { chromium } from 'playwright';

const sql = neon(process.env.DATABASE_URL);

async function scrapeEvents(context) {
    const page = await context.newPage();
    await page.goto('http://ufcstats.com/statistics/events/completed?page=all');

    const eventRows = await page.locator('.b-statistics__table-row');

    const eventLinks = await eventRows.evaluateAll((row) => {
        return row
            .map((row) => {
                const aTag = row.querySelector('.b-link');
                if (aTag) {
                    const href = aTag.getAttribute('href');
                    return href;
                }
            })
            .filter((link) => link);
    });

    //Scrape event page
    for (const eventLink of eventLinks) {
        await page.goto(eventLink);
        const eventPageData = await parseEventPage(page);
        await sql`
            INSERT INTO ufc_events (event_name, event_date, event_location)
            VALUES (${eventPageData.event_name}, ${eventPageData.event_date}, ${eventPageData.event_location});
        `;
    }
    await page.close();
    console.log('Finished Scraping Events');
}

async function scrapeFighters(context) {
    const page = await context.newPage();
    await page.goto('http://ufcstats.com/statistics/events/completed?page=all');

    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (const letter of letters) {
        await page.goto(
            `http://ufcstats.com/statistics/fighters?char=${letter}&page=all`
        );

        const fighterRows = await page.locator('.b-statistics__table-row');
        const fighterLinks = await fighterRows.evaluateAll((rows) => {
            return rows
                .map((row) => {
                    const aTag = row.querySelector('.b-link');
                    if (aTag) {
                        const href = aTag.getAttribute('href');
                        return href;
                    }
                })
                .filter((link) => link);
        });

        //Process each fighter stats and info
        for (const link of fighterLinks) {
            await page.goto(link);
            const fighterData = await parseFighterPage(page);
            await sql`
                INSERT INTO fighters (first_name, last_name, age, height, weight, reach, stance, slmp, strAcc, sapm, strDef, tdAvg, tdAcc, tdDef, subAvg)
                VALUES (${fighterData.first_name}, ${fighterData.last_name}, ${fighterData.age}, ${fighterData.height}, ${fighterData.weight}, ${fighterData.reach}, ${fighterData.stance}, ${fighterData.slmp}, ${fighterData.strAcc}, ${fighterData.sapm}, ${fighterData.strDef}, ${fighterData.tdAvg}, ${fighterData.tdAcc}, ${fighterData.tdDef}, ${fighterData.subAvg});
            `;
        }
    }
    await page.close();
    console.log('Finished Scraping Fighters');
}

async function parseEventPage(page) {
    let eventData = {};
    const eventName = await page
        .locator('.b-content__title-highlight')
        .textContent();
    eventData.event_name = eventName.trim();
    const ul = await page.locator('.b-list__box-list');

    const eventDetails = await ul.evaluate((list) => {
        const items = Array.from(
            list.querySelectorAll('.b-list__box-list-item')
        );
        const data = {};

        items.forEach((item) => {
            const text = item.textContent.trim();
            if (text.includes('Date:')) {
                data.event_date = text.replace('Date:', '').trim();
            } else if (text.includes('Location:')) {
                data.event_location = text.replace('Location:', '').trim();
            }
        });
        return data;
    });

    eventData.event_date = eventDetails.event_date;
    eventData.event_location = eventDetails.event_location;

    return eventData;
}

async function parseFighterPage(page) {
    let fighterData = {};
    const fighter = await page.locator('.b-statistics__section_details');
    const nameObj = await fighter.evaluate((section) => {
        const fullName = section
            .querySelector('.b-content__title-highlight')
            .textContent.trim();
        return {
            first_name: fullName.substring(0, fullName.indexOf(' ')),
            last_name: fullName.substring(fullName.indexOf(' ')).trim(),
        };
    });
    fighterData = { ...nameObj };

    const fighterStats = await page.locator('.b-fight-details');
    const statsObj = await fighterStats.evaluate((details) => {
        let tempObj = {};
        details.querySelectorAll('li').forEach((liElement) => {
            const category = liElement.firstElementChild.innerHTML.trim();
            const value = liElement.lastChild.textContent.trim();
            if (category.includes('Height')) {
                tempObj.height = value === '--' ? null : value;
            } else if (category.includes('Weight')) {
                tempObj.weight =
                    value === '--' ? null : parseInt(value.split(' ')[0]);
            } else if (category.includes('Reach')) {
                tempObj.reach =
                    value === '--' ? null : parseInt(value.replace('"', ''));
            } else if (category.includes('Stance')) {
                tempObj.stance = value === '--' ? null : value;
            } else if (category.includes('SLpM')) {
                tempObj.slpm = value === '0.00' ? null : Number(value);
            } else if (category.includes('Str. Acc')) {
                tempObj.strAcc =
                    value === '0%' ? null : parseFloat(value) / 100;
            } else if (category.includes('SApM')) {
                tempObj.sapm = value === '0.00' ? null : Number(value);
            } else if (category.includes('Str. Def')) {
                tempObj.strDef =
                    value === '0%' ? null : parseFloat(value) / 100;
            } else if (category.includes('TD Avg')) {
                tempObj.tdAvg = value === '0.00' ? null : Number(value);
            } else if (category.includes('TD Acc')) {
                tempObj.tdAcc = value === '0%' ? null : parseFloat(value) / 100;
            } else if (category.includes('TD Def')) {
                tempObj.tdDef = value === '0%' ? null : parseFloat(value) / 100;
            } else if (category.includes('Sub. Avg')) {
                tempObj.subAvg = value === '0.0' ? null : Number(value);
            }
        });
        return tempObj;
    });
    fighterData = { ...fighterData, ...statsObj };

    return fighterData;
}

async function scrape() {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
    });

    await scrapeEvents(context);
    await scrapeFighters(context);

    await browser.close();
}

scrape();
