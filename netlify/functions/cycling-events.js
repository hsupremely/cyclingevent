const axios = require('axios');
const cheerio = require('cheerio');

class CyclingEventsAPI {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    // BikeReg.com scraper
    async getBikeRegEvents(searchParams = {}) {
        try {
            const { state = '', discipline = '', month = '' } = searchParams;
            const url = `https://www.bikereg.com/events?state=${state}&discipline=${discipline}&month=${month}`;
            
            const response = await axios.get(url, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const events = [];

            $('.event-item, .event-row').each((i, element) => {
                const $el = $(element);
                
                const event = {
                    source: 'bikereg',
                    name: $el.find('.event-title, .event-name a').text().trim(),
                    date: this.parseDate($el.find('.event-date, .date').text().trim()),
                    location: $el.find('.event-location, .location').text().trim(),
                    url: 'https://www.bikereg.com' + $el.find('a').attr('href'),
                    discipline: $el.find('.event-discipline, .discipline').text().trim(),
                    distance: $el.find('.event-distance, .distance').text().trim()
                };

                if (event.name && event.date) {
                    events.push(event);
                }
            });

            return events;
        } catch (error) {
            console.error('Error fetching BikeReg events:', error.message);
            return [];
        }
    }

    // Strava Events scraper (Note: Strava has limited public event data)
    async getStravaEvents(lat = 40.7128, lng = -74.0060, radius = 50) {
        try {
            // Strava's events are typically accessed through their API which requires authentication
            // This is a placeholder for the structure you'd need
            const events = [];
            
            // For actual implementation, you'd need:
            // 1. Strava API access token
            // 2. Use their segments/events endpoints
            // 3. Handle OAuth authentication
            
            console.log('Strava events require API authentication. Placeholder implementation.');
            
            return events;
        } catch (error) {
            console.error('Error fetching Strava events:', error.message);
            return [];
        }
    }

    // NYCC (New York Cycle Club) scraper
    async getNYCCEvents() {
        try {
            const url = 'https://nycc.org/rides';
            const response = await axios.get(url, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const events = [];

            $('.ride-item, .event-item, .ride-listing').each((i, element) => {
                const $el = $(element);
                
                const event = {
                    source: 'nycc',
                    name: $el.find('.ride-title, .event-title, h3, h4').text().trim(),
                    date: this.parseDate($el.find('.ride-date, .event-date, .date').text().trim()),
                    location: $el.find('.ride-location, .location, .start-location').text().trim(),
                    url: this.buildFullUrl($el.find('a').attr('href'), 'https://nycc.org'),
                    leader: $el.find('.ride-leader, .leader').text().trim(),
                    pace: $el.find('.pace, .ride-pace').text().trim(),
                    distance: $el.find('.distance, .ride-distance').text().trim()
                };

                if (event.name && event.date) {
                    events.push(event);
                }
            });

            return events;
        } catch (error) {
            console.error('Error fetching NYCC events:', error.message);
            return [];
        }
    }

    // Alternative NYCC calendar scraper
    async getNYCCCalendarEvents() {
        try {
            const url = 'https://nycc.org/calendar';
            const response = await axios.get(url, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const events = [];

            $('.calendar-event, .event').each((i, element) => {
                const $el = $(element);
                
                const event = {
                    source: 'nycc_calendar',
                    name: $el.find('.event-title, .title').text().trim(),
                    date: this.parseDate($el.find('.event-date, .date').text().trim()),
                    location: $el.find('.event-location, .location').text().trim(),
                    url: this.buildFullUrl($el.find('a').attr('href'), 'https://nycc.org'),
                    time: $el.find('.event-time, .time').text().trim(),
                    type: $el.find('.event-type, .type').text().trim()
                };

                if (event.name && event.date) {
                    events.push(event);
                }
            });

            return events;
        } catch (error) {
            console.error('Error fetching NYCC calendar events:', error.message);
            return [];
        }
    }

    // Utility function to parse dates
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Handle various date formats
        const cleanDate = dateString.replace(/[^\d\/\-\s:APMapm]/g, ' ').trim();
        const date = new Date(cleanDate);
        
        return date.toString() !== 'Invalid Date' ? date.toISOString() : dateString;
    }

    // Utility function to build full URLs
    buildFullUrl(path, baseUrl) {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return baseUrl + (path.startsWith('/') ? path : '/' + path);
    }

    // Main function to get all events
    async getAllEvents(options = {}) {
        const {
            includeBikeReg = true,
            includeStrava = false, // Disabled by default due to API requirements
            includeNYCC = true,
            bikeRegParams = {},
            stravaParams = {}
        } = options;

        const allEvents = [];

        try {
            if (includeBikeReg) {
                console.log('Fetching BikeReg events...');
                const bikeRegEvents = await this.getBikeRegEvents(bikeRegParams);
                allEvents.push(...bikeRegEvents);
            }

            if (includeStrava) {
                console.log('Fetching Strava events...');
                const stravaEvents = await this.getStravaEvents(stravaParams);
                allEvents.push(...stravaEvents);
            }

            if (includeNYCC) {
                console.log('Fetching NYCC events...');
                const nyccEvents = await this.getNYCCEvents();
                const nyccCalendarEvents = await this.getNYCCCalendarEvents();
                allEvents.push(...nyccEvents, ...nyccCalendarEvents);
            }

            // Remove duplicates and sort by date
            const uniqueEvents = this.removeDuplicates(allEvents);
            return this.sortEventsByDate(uniqueEvents);

        } catch (error) {
            console.error('Error fetching events:', error.message);
            return [];
        }
    }

    // Remove duplicate events
    removeDuplicates(events) {
        const seen = new Set();
        return events.filter(event => {
            const key = `${event.name}_${event.date}_${event.source}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Sort events by date
    sortEventsByDate(events) {
        return events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });
    }

    // Express.js API endpoints
    createExpressAPI(app) {
        // Get all events
        app.get('/api/events', async (req, res) => {
            try {
                const options = {
                    includeBikeReg: req.query.bikereg !== 'false',
                    includeStrava: req.query.strava === 'true',
                    includeNYCC: req.query.nycc !== 'false',
                    bikeRegParams: {
                        state: req.query.state || '',
                        discipline: req.query.discipline || '',
                        month: req.query.month || ''
                    }
                };

                const events = await this.getAllEvents(options);
                res.json({
                    success: true,
                    count: events.length,
                    events: events
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get BikeReg events only
        app.get('/api/events/bikereg', async (req, res) => {
            try {
                const params = {
                    state: req.query.state || '',
                    discipline: req.query.discipline || '',
                    month: req.query.month || ''
                };
                const events = await this.getBikeRegEvents(params);
                res.json({
                    success: true,
                    count: events.length,
                    events: events
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get NYCC events only
        app.get('/api/events/nycc', async (req, res) => {
            try {
                const events = await this.getNYCCEvents();
                res.json({
                    success: true,
                    count: events.length,
                    events: events
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }
}

// Usage examples
async function main() {
    const api = new CyclingEventsAPI();

    // Example 1: Get all events
    console.log('Fetching all events...');
    const allEvents = await api.getAllEvents({
        bikeRegParams: { state: 'NY', discipline: 'Road' }
    });
    console.log(`Found ${allEvents.length} events total`);

    // Example 2: Get only BikeReg events
    const bikeRegEvents = await api.getBikeRegEvents({ 
        state: 'NY', 
        discipline: 'Road' 
    });
    console.log(`Found ${bikeRegEvents.length} BikeReg events`);

    // Example 3: Get only NYCC events
    const nyccEvents = await api.getNYCCEvents();
    console.log(`Found ${nyccEvents.length} NYCC events`);

    // Return sample JSON structure
    return {
        total_events: allEvents.length,
        sample_event: allEvents[0] || null,
        sources: ['bikereg', 'nycc'],
        api_endpoints: [
            'GET /api/events - Get all events',
            'GET /api/events?bikereg=false - Exclude BikeReg',
            'GET /api/events?state=NY&discipline=Road - Filter BikeReg',
            'GET /api/events/bikereg - BikeReg only',
            'GET /api/events/nycc - NYCC only'
        ]
    };
}

// Export for use
module.exports = CyclingEventsAPI;

// Express.js server setup example
/*
const express = require('express');
const app = express();
const api = new CyclingEventsAPI();

api.createExpressAPI(app);

app.listen(3000, () => {
    console.log('Cycling Events API running on port 3000');
});
*/
