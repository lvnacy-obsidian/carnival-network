The **client** creates the `performerInfo` (it knows about the current performer), 
then the **service** uses it to register with registries. This follows the 
dependency injection pattern - data flows down from client to service.

```
CarnivalNetworkClient
  ↓ creates performerInfo (knows about current performer)
  ↓ calls: territoryService.establishTerritory(territory, performerInfo)
HttpRegistryService
  ↓ uses provided performerInfo to register
  ↓ calls registries
```
