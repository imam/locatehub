<template>
  <div class="bg-blue-300 h-screen">
    <div class="max-w-lg mx-auto bg-white h-screen">
      <div class="font-bold flex items-center justify-center" style="height: 15vh">
        <h1>Locate Hub</h1>
      </div>
      <div class="bg-red-200" style="height: 40vh">
        <GoogleMap
          api-key="AIzaSyD7f9HrpnKQ0vcnkBcaC_RcspwIE4C5G6c"
          style="width: 100%; height: 40vh"
          :center="center"
          :zoom="15"
          ref="mapRef"
          >
            <Marker :options="{position: hub.latLng, label: hub.label}" v-for="hub in hubs" :key="hub.id" /> 
          </GoogleMap>
      </div>
      <div class="" style="height: 45vh">
        <div class="py-2 px-3 border-b-2 flex">
          <h1 class="font-bold">Hubs Near You</h1>
          <a class="ml-3 text-blue-500 text-sm" v-on:click="() => toggleFindAddress()" href="#">Or Find An Address</a>
        </div>
        <div class="inset-x-0 top-0 border-b-2" v-if="showFindAddress">
          <input type="text" class="w-full py-4 px-3" placeholder="Input Your Address Here" v-model="findAddressValue" />
        </div>
        <div class="overflow-y-auto relative" ref="listOfHubsRef" :style="showFindAddress ? 'max-height: calc(45vh - 42px - 58px)' : 'max-height: calc(45vh - 42px)'">
          <a href="#" @click.prevent="mapPanTo(hub.latLng.lat, hub.latLng.lng)" class="py-2 px-6 border-b-2 flex hover:bg-blue-100" v-for="hub in hubs" :key="hub.id">
            <h1 class="py-6 mr-auto">{{hub.road}}</h1>
            <div class="flex items-center">
              <div class="bg-yellow-200 rounded-full h-12 w-12 text-center flex items-center justify-center">
                <span>{{hub.label}}</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, Ref, ref, watchEffect, watch } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import hubsSource from './hubs'
import { GoogleMap, Marker } from 'vue3-google-map'
import {IpregistryClient} from '@ipregistry/client'
import * as geo from 'opencage-api-client'
import _ from 'lodash'
import axios from 'axios'

const {debounce} = _

export default defineComponent({
  name: 'App',
  components: {
    HelloWorld,
    GoogleMap, Marker
  },
  setup() {
    const hubs = ref(hubsSource)
    interface latLng {lat: number, lng: number}
    const center : latLng = { lat: 40.689247, lng: -74.044502 }
    const mapRef: Ref<any> = ref({ready: false})
    const mapInitiated = ref(false)
    const showFindAddress = ref(false)
    const findAddressValue: Ref<string | null> = ref(null)
    const currentMapCenter = ref(center)
    const listOfHubsRef = ref(HTMLElement)

    const client = new IpregistryClient('69cd17418suc7l');
    const alphabets =  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

    const labeledHubs = hubs.value.map((hub, key) => {
      return {
        ...hub,
        label: alphabets[key]
      } 
    })

    const hubWithCalculatedDistances = ref(labeledHubs)

    const requestToCalcHubDistancesToOpenService = (hubLatLngs : [lng: number, lat: number][]) => axios.post('https://api.openrouteservice.org/v2/matrix/driving-car', {
        locations: hubLatLngs,
        sources: [0]
      }, {
        headers: {
          'Authorization' : '5b3ce3597851110001cf6248464bca48333c4b759d71786960c17239'
        }
      }).then(data => {
        const durations : [number] = data.data.durations[0]

        //Remove the first element as it is the coordinate for the current center of the map
        durations.shift()
        return durations
      })

    //Why? Refer to : https://stackoverflow.com/questions/54690118/why-is-google-maps-getcenter-returning-invalid-coordinates
    const normalizeLng = (lng: number) => {
      if(lng > 180) {
        return lng - 360
      }
      if(lng < -180) {
        return lng + 360
      }
      return lng
    }

    const calcDistanceToHubs = async (latLng : latLng) => {
      const everyHubLatLng : [lng: number, lat: number][] = hubs.value.map(hub => {
        return [hub.latLng.lng,hub.latLng.lat]
      })

      everyHubLatLng.unshift([normalizeLng(latLng.lng), latLng.lat])

      const distances = await requestToCalcHubDistancesToOpenService(everyHubLatLng)
      const hubWithDistances = labeledHubs.map((hub, key) => {
        return {
          ...hub,
          distance: distances[key]
        }
      })

      console.log(_.orderBy(hubWithDistances, ['distance']))
      hubWithCalculatedDistances.value = _.orderBy(hubWithDistances, ['distance'])
      console.log((listOfHubsRef.value as any).scrollTop = 0)
      
    }

    const mapPanTo = (lat : number, lng: number) => {
        const latLng : latLng  = {lat, lng}
        mapRef.value?.map.panTo(latLng)
        updateCurrentMapCenter()
    }

    const updateCurrentMapCenter = () => {
      currentMapCenter.value = {lat: mapRef.value.map.center.lat(), lng:mapRef.value.map.center.lng()}
    }

    const debounceUpdateCurrentMapCenter = debounce(updateCurrentMapCenter, 1500)
    
    // Give an address, we'll pan to the location
    const panToAddressString = (q: string) => {
      return geo.geocode({
        key: 'e9b55646145246ca9b686a4a0acfb2ba',
        q: q + ', singapore'
      }).then(data => {
        const latLng = data.results[0].geometry
        mapPanTo(latLng.lat, latLng.lng)
        return data
      })
    }

    const debouncedPanToAddressString = debounce((q:string ) => panToAddressString(q), 500)

    const findCurrentClientIpOriginLocation = client.originLookup()

    const watchMapDraggingEvent = () => mapRef.value?.api.event.addListener(mapRef.value.map, 'dragend', (data: any) =>{
      debounceUpdateCurrentMapCenter()
    })

    const isMapReady = () => mapRef.value?.ready

    watchEffect(() =>{
      if(isMapReady()) {
        if(!mapInitiated.value){
          findCurrentClientIpOriginLocation.then(data => {
            mapPanTo(data.data.location.latitude!, data.data.location.longitude!)
          })
          mapInitiated.value = true
        }
      }

      if(mapRef.value?.api){
        watchMapDraggingEvent()
      }
    })


    watch(findAddressValue, (q) => {
      if(q) {
        debouncedPanToAddressString(q)
      }
    })

    watch(currentMapCenter, data => {
      console.log(data)
      calcDistanceToHubs(data) 
    })


    return { 
      center, 
      mapRef, 
      alphabets, 
      hubs: hubWithCalculatedDistances, 
      showFindAddress, 
      panToAddressString, 
      toggleFindAddress : () => {
        showFindAddress.value = !showFindAddress.value
      },
      setFindAddressValue: (q: string) => {
        findAddressValue.value = q
      },
      findAddressValue,
      mapPanTo,
      listOfHubsRef
    }
  },
})
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
