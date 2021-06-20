import hubsSource from './hubs.json'

export interface Country{
    currency_code: string,
    currency_symbol: string,
    description: string,
    id: number,
    name: string
}

export interface Hub {
    building: string | null,
    city: string,
    country: Country,
    floor_number: string| null,
    postal_code: string| null,
    road: string,
    state: string,
    street_number: string| null,
    unit: string| null,
    name : string| null,
    id: number,
    latLng: {
        lat: number,
        lng: number
    }
}

const hubs : Hub[] = hubsSource.data

export default hubs