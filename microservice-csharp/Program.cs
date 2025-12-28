using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Ajouter la configuration optimale
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 104857600; // 100MB
    options.Limits.MaxConcurrentConnections = 1000;
    options.Limits.MinRequestBodyDataRate = null;
});

var app = builder.Build();

// API REST optimisée et typée
app.MapGet("/deliveries", () => Results.Json(new[] { new { Id = 1, Name = "Delivery A" } }));
app.MapGet("/drivers", () => Results.Json(new[] { new { Id = 1, Name = "Driver X" } }));
app.MapGet("/routes", () => Results.Json(new[] { new { Id = 1, From = "A", To = "B" } }));

app.Run();
