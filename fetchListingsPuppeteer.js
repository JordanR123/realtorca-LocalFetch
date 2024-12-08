const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        console.log('Connecting to existing browser...');
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9222' // Connect to Edge via debugging port
        });

        const initialPage = await browser.newPage();

        const baseUrl = 'https://www.realtor.ca/map#ZoomLevel=10&Center=49.058181%2C-122.198065&LatitudeMax=49.33682&LongitudeMax=-120.93601&LatitudeMin=48.77797&LongitudeMin=-123.46012&view=list&Sort=6-D&PGeoIds=g30_c2c4ud6q&GeoName=Fraser%20Valley%2C%20BC&PropertyTypeGroupID=1&TransactionTypeId=2&PropertySearchTypeId=0&PriceMin=500000&PriceMax=700000&BedRange=3-0&BathRange=2-0&Currency=CAD&HiddenListingIds=&IncludeHiddenListings=false';

        const MIN_SQUARE_FEET = 1800; // Minimum square footage filter
        const SCRAPE_ALL_PAGES = true; // Set to true to scrape all pages, false for first 2 pages

        console.log('Navigating to the initial page...');
        await initialPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        console.log('Waiting 6 seconds for the initial page to load...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        console.log('Determining total number of pages...');
        const totalPages = await initialPage.evaluate(() => {
            const pageCountElement = document.evaluate(
                '//*[@id="ListViewPagination_Bottom"]/div/div/div/span[2]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            return pageCountElement ? parseInt(pageCountElement.textContent.trim()) : 1;
        });

        const pagesToScrape = SCRAPE_ALL_PAGES ? totalPages : Math.min(totalPages, 2);
        console.log(`Total pages to scrape: ${pagesToScrape}`);
        await initialPage.close(); // Close the initial page

        const pageUrls = [];
        for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
            const pageUrl = `${baseUrl}&CurrentPage=${currentPage}`;
            pageUrls.push(pageUrl);
        }

        console.log('Opening all pages in separate tabs with a 1-second delay...');
        const pages = [];
        for (const [index, url] of pageUrls.entries()) {
            console.log(`Opening tab for page ${index + 1}: ${url}`);
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            pages.push(page);

            console.log(`Opened tab for page ${index + 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay before opening the next tab
        }

        console.log('Waiting 5 seconds for all tabs to fully load...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Scraping data from all tabs...');
        const allListings = (
            await Promise.all(
                pages.map(async (page, index) => {
                    console.log(`Scraping data from page ${index + 1}...`);
                    try {
                        const pageListings = await page.evaluate(() => {
                            const listings = [];
                            const baseUrl = "https://www.realtor.ca"; // Base URL for constructing absolute links

                            const elements = document.evaluate(
                                '//*[@id="listInnerCon"]/div/div/a', 
                                document,
                                null,
                                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                null
                            );

                            for (let i = 0; i < elements.snapshotLength; i++) {
                                const element = elements.snapshotItem(i);
                                const link = element.getAttribute('href') 
                                    ? `${baseUrl}${element.getAttribute('href')}` 
                                    : 'N/A';

                                const price = element.querySelector('div > div:nth-child(2) > div:nth-child(1) > div:nth-child(2)');
                                const squareFootage = element.querySelector('div > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div:nth-child(1) > div:nth-child(2)');
                                const addressFull = element.querySelector('div > div:nth-child(2) > div:nth-child(1) > div:nth-child(3)');

                                if (addressFull) {
                                    const [street, city, province] = addressFull.textContent.split(", ").map(s => s.trim());
                                    listings.push({
                                        price: price ? price.textContent.trim() : 'N/A',
                                        squareFootage: squareFootage ? squareFootage.textContent.trim() : 'N/A',
                                        street: street || 'N/A',
                                        city: city || 'N/A',
                                        province: province || 'N/A',
                                        link: link,
                                    });
                                }
                            }

                            return listings;
                        });

                        console.log(`Extracted ${pageListings.length} listings from page ${index + 1}.`);

                        // Filter by square footage
                        return pageListings.filter(listing => {
                            const squareFeet = parseInt(listing.squareFootage.replace(/[^0-9]/g, ''), 10);
                            return squareFeet >= MIN_SQUARE_FEET;
                        });
                    } catch (error) {
                        console.error(`Error scraping page ${index + 1}:`, error.message);
                        return [];
                    }
                })
            )
        ).flat();

        console.log(`Total filtered listings extracted: ${allListings.length}`);

        console.log('Closing all tabs...');
        await Promise.all(pages.map(page => page.close()));

        // Generate unique filename
        let baseFilename = 'listings.csv';
        let counter = 1;
        let filename = path.join(__dirname, baseFilename);
        while (fs.existsSync(filename)) {
            filename = path.join(__dirname, `listings_${counter}.csv`);
            counter++;
        }

        // Save listings to CSV
        const csv = [
            ['Price', 'Square Footage', 'Street', 'City', 'Province', 'Link'],
            ...allListings.map(listing => [
                `"${listing.price}"`, // Enclose price in quotes
                `"${listing.squareFootage}"`,
                `"${listing.street}"`,
                `"${listing.city}"`,
                `"${listing.province}"`,
                `"${listing.link}"`
            ])
        ].map(row => row.join(',')).join('\n');

        fs.writeFileSync(filename, csv);
        console.log(`Listings saved to ${filename}.`);

        await browser.disconnect();
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
})();
