import Foundation

struct MSHEvidenceObservation: Identifiable, Sendable, Equatable {
    enum Source: String, Sendable {
        case whoGlobalHealthObservatory = "WHO Global Health Observatory"
    }

    let id: String
    let source: Source
    let indicatorCode: String
    let indicatorName: String?
    let geographyCode: String?
    let time: Int?
    let dimension1: String?
    let dimension2: String?
    let dimension3: String?
    let valueText: String?
    let numericValue: Double?
    let low: Double?
    let high: Double?
    let retrievedAt: Date

    /// Population-level evidence is context, not a personal health observation or prediction.
    let applicability: Applicability

    enum Applicability: String, Sendable {
        case populationLevel
    }
}

struct MSHWHOIndicator: Identifiable, Decodable, Sendable, Equatable {
    let indicatorCode: String
    let indicatorName: String

    var id: String { indicatorCode }

    private enum CodingKeys: String, CodingKey {
        case indicatorCode = "IndicatorCode"
        case indicatorName = "IndicatorName"
    }
}

struct MSHWHOEvidenceProvider: Sendable {
    private static let serviceRoot = URL(string: "https://ghoapi.azureedge.net/api")!
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func indicators(containing searchText: String) async throws -> [MSHWHOIndicator] {
        let escaped = Self.escapeODataString(searchText)
        let filter = "contains(IndicatorName,'\(escaped)')"
        let url = try Self.makeURL(path: "Indicator", queryItems: [
            URLQueryItem(name: "$filter", value: filter)
        ])
        let response: WHOEnvelope<MSHWHOIndicator> = try await request(url)
        return response.value
    }

    func evidence(
        indicatorCode: String,
        filters: [String] = [],
        top: Int? = nil
    ) async throws -> [MSHEvidenceObservation] {
        var queryItems: [URLQueryItem] = []

        if !filters.isEmpty {
            queryItems.append(URLQueryItem(name: "$filter", value: filters.joined(separator: " and ")))
        }
        if let top {
            queryItems.append(URLQueryItem(name: "$top", value: String(top)))
        }

        let url = try Self.makeURL(path: indicatorCode, queryItems: queryItems)
        let response: WHOEnvelope<WHOFact> = try await request(url)
        let retrievedAt = Date()

        return response.value.map { fact in
            MSHEvidenceObservation(
                id: Self.factID(indicatorCode: indicatorCode, fact: fact),
                source: .whoGlobalHealthObservatory,
                indicatorCode: indicatorCode,
                indicatorName: fact.indicatorName,
                geographyCode: fact.spatialDim,
                time: fact.timeDim,
                dimension1: fact.dim1,
                dimension2: fact.dim2,
                dimension3: fact.dim3,
                valueText: fact.value,
                numericValue: fact.numericValue,
                low: fact.low,
                high: fact.high,
                retrievedAt: retrievedAt,
                applicability: .populationLevel
            )
        }
    }

    static func filter(dimension: String, equals code: String) -> String {
        "\(dimension) eq '\(escapeODataString(code))'"
    }

    static func yearFilter(_ year: Int) -> [String] {
        [
            "date(TimeDimensionBegin) ge \(year)-01-01",
            "date(TimeDimensionBegin) lt \(year + 1)-01-01"
        ]
    }

    static func makeURL(path: String, queryItems: [URLQueryItem] = []) throws -> URL {
        guard !path.isEmpty,
              !path.contains("/"),
              !path.contains("..") else {
            throw MSHWHOError.invalidPath
        }

        let endpoint = serviceRoot.appendingPathComponent(path)
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw MSHWHOError.invalidURL
        }
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components.url else {
            throw MSHWHOError.invalidURL
        }
        return url
    }

    private func request<T: Decodable>(_ url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MSHWHOError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw MSHWHOError.httpStatus(httpResponse.statusCode)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw MSHWHOError.decoding(error.localizedDescription)
        }
    }

    private static func escapeODataString(_ value: String) -> String {
        value.replacingOccurrences(of: "'", with: "''")
    }

    private static func factID(indicatorCode: String, fact: WHOFact) -> String {
        [
            indicatorCode,
            fact.spatialDim ?? "",
            fact.timeDim.map(String.init) ?? "",
            fact.dim1 ?? "",
            fact.dim2 ?? "",
            fact.dim3 ?? ""
        ].joined(separator: "|")
    }
}

private struct WHOEnvelope<Value: Decodable>: Decodable {
    let value: [Value]
}

private struct WHOFact: Decodable {
    let indicatorName: String?
    let spatialDim: String?
    let timeDim: Int?
    let dim1: String?
    let dim2: String?
    let dim3: String?
    let value: String?
    let numericValue: Double?
    let low: Double?
    let high: Double?

    private enum CodingKeys: String, CodingKey {
        case indicatorName = "IndicatorName"
        case spatialDim = "SpatialDim"
        case timeDim = "TimeDim"
        case dim1 = "Dim1"
        case dim2 = "Dim2"
        case dim3 = "Dim3"
        case value = "Value"
        case numericValue = "NumericValue"
        case low = "Low"
        case high = "High"
    }
}

enum MSHWHOError: Error, Sendable, Equatable {
    case invalidPath
    case invalidURL
    case invalidResponse
    case httpStatus(Int)
    case decoding(String)
}
