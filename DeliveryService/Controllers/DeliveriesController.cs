using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace DeliveryService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class DeliveriesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetDeliveries()
        {
            var deliveries = new List<string> { "LIV001", "LIV002", "LIV003" };
            return Ok(new { status = "ok", deliveries });
        }
    }
}
