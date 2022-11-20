# Subgraph Wrapper for ERC721 subgraph that resolve IPFS metadata

## The Problem

The graph protocol hosted server or graph network can't resolve IPFS JSON data properly. Almost 50-70% IPFS JSON data missed by the graph indexer. As a result we need to refetch all IPFS data from client side every time we load a page which is slower and time consumable.

## The solution

To solve this problem, This application

- Create a wrapper of the existing subgraph from the graphprotocol
- Create a local database for IPFS metadata and store the data by fetching from IPFS on first time query
- Merge the remote and local schema and create a hybrid graphql schema
- Graphql UI
- Support both query and subscription . (HTTP and WS)

## Use case

- This subgraph-wrapper server resolve ERC721 metadata

## Future Improvement

- Implement Fast / Multiple IPFS gateway
- Resolve IPFS data using queue to remove waiting period
- Refresh metadata API

## Tech Stack

```
express
typeorm
mysql
graphql
thegraphprotocol
ipfs
axios
```

## Author

Nawab Khairuzzaman Mohammad Kibria

### Reference

[Compound Subgraph Wrapper]("https://github.com/graphprotocol/compound-subgraph-wrapper")
A wrapper service that extends the Compound subgraph with custom resolvers.
