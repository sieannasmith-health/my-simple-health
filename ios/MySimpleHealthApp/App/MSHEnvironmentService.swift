import CoreLocation
import Foundation
import WeatherKit

enum MSHEnvironmentalSource: String, Codable, Sendable {
    case appleWeatherKit = "apple_weatherkit"
}

struct MSHEnvironmentalObservation: Codable, Equatable, Sendable {
    let observedAt: Date
    let latitude: Double
    let longitude: Double
    let temperatureCelsius: Double
    let apparentTemperatureCelsius: Double
    let relativeHumidity: Double
    let condition: String
    let symbolName: String
    let isDaylight: Bool
    let source: MSHEnvironmentalSource
}

protocol MSHCurrentWeatherProviding: Sendable {
    func currentWeather(for location: CLLocation) async throws -> CurrentWeather
}

struct MSHWeatherKitProvider: MSHCurrentWeatherProviding {
    func currentWeather(for location: CLLocation) async throws -> CurrentWeather {
        try await WeatherService.shared.weather(for: location, including: .current)
    }
}

actor MSHEnvironmentService {
    static let shared = MSHEnvironmentService()

    private let weatherProvider: any MSHCurrentWeatherProviding

    init(weatherProvider: any MSHCurrentWeatherProviding = MSHWeatherKitProvider()) {
        self.weatherProvider = weatherProvider
    }

    /// Fetches current environmental conditions for a caller-supplied location and
    /// converts WeatherKit's model into MSH's provider-neutral environmental model.
    ///
    /// Keeping this model provider-neutral lets air quality, pollen, climate, and
    /// other environmental-health sources join the same layer later without making
    /// the rest of My Simple Health depend directly on WeatherKit types.
    func currentObservation(for location: CLLocation) async throws -> MSHEnvironmentalObservation {
        let current = try await weatherProvider.currentWeather(for: location)

        return MSHEnvironmentalObservation(
            observedAt: current.date,
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            temperatureCelsius: current.temperature.converted(to: .celsius).value,
            apparentTemperatureCelsius: current.apparentTemperature.converted(to: .celsius).value,
            relativeHumidity: current.humidity,
            condition: String(describing: current.condition),
            symbolName: current.symbolName,
            isDaylight: current.isDaylight,
            source: .appleWeatherKit
        )
    }
}
