# Stage build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copier les fichiers du projet
COPY . .

# Restauration et build
RUN dotnet restore
RUN dotnet publish -c Release -o /app

# Stage runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Expose le port de l'API
EXPOSE 5124

# Démarrage du microservice
ENTRYPOINT ["dotnet", "DeliveryService.dll"]
